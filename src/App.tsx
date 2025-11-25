import { useEffect, useRef, useState } from 'react';
import { Trophy, Users, Copy, LogOut } from 'lucide-react';
import './App.css';

type Screen = 'home' | 'join' | 'username' | 'game';
type Mode = 'create' | 'join';

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
};

const romanKeys = ['I', 'V', 'X', 'L', 'C', 'D', 'M'] as const;
const storageKey = 'numerus-room';

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

    return { code: String(parsed.code), players: loadedPlayers, showHints: Boolean(parsed.showHints) };
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
    showHints: room.showHints
  };

  localStorage.setItem(storageKey, JSON.stringify(payload));
};

const App = () => {
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
  const [storedRoom, setStoredRoom] = useState<StoredRoom | null>(() => readStoredRoom());
  const [showHints, setShowHints] = useState<boolean>(() => readStoredRoom()?.showHints ?? false);
  const messagesEndRef = useRef<HTMLDivElement>(null);



  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
  }, [players, showHints, currentNumber, gameOver]);

  const persistRoom = (code: string, playerList: Player[], hints: boolean) => {
    if (!code) return;
    const snapshot: StoredRoom = { code, players: playerList, showHints: hints };
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
      setRoomCode(normalized);
      setShowHints(Boolean(storedRoom.showHints));
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
    persistRoom(codeToUse, updatedPlayers, showHints);
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

    const botNames = ['Samuele', 'Tommy', 'Fra', 'Mela', 'Igor', 'Andrea la Valanga', 'Diana', 'Edo', 'Kledi', 'Martino del Trentino', 'Vince'];
    const usedNames = new Set(players.map((p) => p.name));
    const availableNames = botNames.filter((name) => !usedNames.has(name));
    if (availableNames.length === 0) return;

    const botName = availableNames[Math.floor(Math.random() * availableNames.length)];
    const newBot = createPlayer(botName, false, true);
    const updatedPlayers = [...players, newBot];
    setPlayers(updatedPlayers);
    persistRoom(roomCode, updatedPlayers, showHints);
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
        persistRoom(roomCode, next, showHints);
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
          persistRoom(roomCode, next, showHints);
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
  }, [players, currentPlayerIndex, currentNumber, currentRoman, gameOver, roomCode, showHints]);

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
      persistRoom(roomCode, next, showHints);
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

  const activePlayer = players[currentPlayerIndex];
  const myPoints = players.find((p) => p.isMe)?.points ?? 0;

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
          {mode === 'create' && (
            <label className="toggle-row">
              <span>Mostra suggerimenti</span>
              <div className="toggle">
                <input
                  type="checkbox"
                  checked={showHints}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setShowHints(checked);
                    if (roomCode) {
                      persistRoom(roomCode, players, checked);
                    }
                  }}
                  aria-label="Mostra numero target"
                />
                <span className="slider" />
              </div>
            </label>
          )}
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
          {messages.map((msg) => (
            <div key={msg.timestamp + msg.text} className="chat-row">
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
          ))}
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
            <button className="primary-btn full" onClick={handleRestart}>
              Rigioca e scegli chi parte
            </button>
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



