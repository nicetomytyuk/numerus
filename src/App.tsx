import { useEffect, useRef, useState } from 'react';
import './App.css';

import type { Difficulty, Mode, Player, Screen, StoredRoom, Message } from './types';
import { romanKeys, HARD_MESSAGE_LIFETIME } from './constants';
import { convertToRoman } from './utils/roman';
import { randomRoomCode } from './utils/random';
import { readStoredRoom, persistRoomSnapshot, writeStoredRoom } from './utils/storage';
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
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const persistRoom = (code: string, playerList: Player[], level: Difficulty) => {
    persistRoomSnapshot(code, playerList, level, setStoredRoom);
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

  if (screen === 'home') {
    return <HomeScreen storedRoom={storedRoom} onCreate={handleCreateGame} onJoin={handleJoinGame} />;
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
      />

      <div className="game-body">
        <PlayersRow
          players={players}
          currentPlayerIndex={currentPlayerIndex}
          gameOver={gameOver}
          onAddBot={handleAddBot}
        />

        <ChatFeed
          messages={messages}
          gameOver={gameOver}
          difficulty={difficulty}
          now={now}
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
              disabled={!activePlayer?.isMe}
              activePlayerName={activePlayer?.name}
              onKeyPress={(key) => handleRomanInput(key as (typeof romanKeys)[number])}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
