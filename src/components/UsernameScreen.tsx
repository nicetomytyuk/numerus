import type { Difficulty, Mode } from '../types';
import DifficultySelector, { type DifficultyOption } from './DifficultySelector';

type Props = {
  mode: Mode;
  roomCode: string;
  usernameInput: string;
  difficulty: Difficulty;
  difficultyOptions: DifficultyOption[];
  onUsernameChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onDifficultyChange: (value: Difficulty) => void;
  error?: string;
  loading?: boolean;
};

const UsernameScreen = ({
  mode,
  roomCode,
  usernameInput,
  difficulty,
  difficultyOptions,
  onUsernameChange,
  onSubmit,
  onCancel,
  onDifficultyChange,
  error,
  loading
}: Props) => (
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
        onChange={(e) => onUsernameChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
      />
      {error && <div className="error-text">{error}</div>}
      <DifficultySelector
        difficulty={difficulty}
        options={difficultyOptions}
        onChange={onDifficultyChange}
      />
      <div className="action-row">
        <button className="primary-btn" onClick={onSubmit} disabled={!usernameInput.trim() || loading}>
          {loading ? 'Connessione...' : 'Continua'}
        </button>
        <button className="ghost-btn" onClick={onCancel}>
          Annulla
        </button>
      </div>
    </div>
  </div>
);

export default UsernameScreen;
