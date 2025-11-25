import type { StoredRoom } from '../types';

type Props = {
  storedRoom?: StoredRoom | null;
  onCreate: () => void;
  onJoin: () => void;
};

const HomeScreen = ({ storedRoom, onCreate, onJoin }: Props) => (
  <div className="app-shell home-screen">
    <div className="home-content">
      <p className="eyebrow">Gioco a turni con numeri romani</p>
      <h1>Stanghetta</h1>
      <p className="lede">
        Crea una stanza, condividi il codice, alterna i turni con la tastiera romana e non
        sbagliare la sequenza.
      </p>
      <div className="cta-row">
        <button className="primary-btn" onClick={onCreate}>
          Gioca
        </button>
        <button className="ghost-btn" onClick={onJoin}>
          Entra in una partita
        </button>
      </div>
      {storedRoom?.code && <p className="hint">Ultima stanza disponibile: {storedRoom.code}</p>}
    </div>
  </div>
);

export default HomeScreen;
