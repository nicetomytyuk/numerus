type Props = {
  pendingCode: string;
  joinError: string;
  onPendingChange: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
};

const JoinScreen = ({ pendingCode, joinError, onPendingChange, onSubmit, onBack }: Props) => (
  <div className="app-shell centered-screen">
    <div className="panel">
      <p className="eyebrow">Entra con codice</p>
      <h2>Inserisci il codice stanza</h2>
      <input
        className="code-input"
        value={pendingCode}
        onChange={(e) => onPendingChange(e.target.value.toUpperCase())}
        placeholder="ABC123"
        maxLength={6}
      />
      {joinError && <div className="error-text">{joinError}</div>}
      <div className="action-row">
        <button className="primary-btn" disabled={pendingCode.trim().length !== 6} onClick={onSubmit}>
          Entra
        </button>
        <button className="ghost-btn" onClick={onBack}>
          Indietro
        </button>
      </div>
    </div>
  </div>
);

export default JoinScreen;
