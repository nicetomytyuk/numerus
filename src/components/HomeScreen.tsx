import type { StoredRoom } from '../types';

type Props = {
  storedRoom?: StoredRoom | null;
  onCreateOnline: () => void;
  onJoinOnline: () => void;
  onCreateOffline: () => void;
  onlineEnabled: boolean;
};

const HomeScreen = ({ storedRoom, onCreateOffline, onCreateOnline, onJoinOnline, onlineEnabled }: Props) => (
  <div className="app-shell home-screen">
    <div className="home-content">
      <div className="home-center">
        <p className="eyebrow">Gioco a turni con numeri romani</p>
        <h1>Stanghetta</h1>
        <p className="lede">
          Crea una stanza, condividi il codice, alterna i turni con la tastiera romana e non
          sbagliare la sequenza.
        </p>
        <div className="cta-row">
          <button className="primary-btn" onClick={onCreateOnline} disabled={!onlineEnabled}>
            Inizia una nuova partita
          </button>
          <button className="ghost-btn" onClick={onJoinOnline} disabled={!onlineEnabled}>
            Entra in una partita
          </button>
        </div>
      </div>
      <div className="home-bottom">
        <button className="link-btn offline-link" onClick={onCreateOffline}>
          Gioca offline
        </button>
        {storedRoom?.code && <p className="hint">Ultima stanza disponibile: {storedRoom.code}</p>}
      </div>
    </div>
  </div>
);

export default HomeScreen;
