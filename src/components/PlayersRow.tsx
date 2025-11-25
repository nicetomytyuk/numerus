import type { Player } from '../types';

type Props = {
  players: Player[];
  currentPlayerIndex: number;
  gameOver: boolean;
  onAddBot: () => void;
};

const PlayersRow = ({ players, currentPlayerIndex, gameOver, onAddBot }: Props) => (
  <section className="players-row">
    <div className="players-scroll">
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
      <button className="ghost-btn small" onClick={onAddBot}>
        + Bot
      </button>
    )}
  </section>
);

export default PlayersRow;
