type Props = {
  keys: readonly string[];
  disabled: boolean;
  activePlayerName?: string;
  overlayLabel?: string;
  onKeyPress: (key: string) => void;
};

const Keyboard = ({ keys, disabled, activePlayerName, overlayLabel, onKeyPress }: Props) => (
  <div className="keyboard-shell">
    <div className={`keyboard ${disabled ? 'disabled' : ''}`}>
      {keys.map((key) => (
        <button key={key} className="key-btn" onClick={() => onKeyPress(key)}>
          {key}
        </button>
      ))}
    </div>
    {disabled && (
      <div className="keyboard-overlay">
        {overlayLabel || `È il turno di ${activePlayerName || '...'}`}
      </div>
    )}
  </div>
);

export default Keyboard;
