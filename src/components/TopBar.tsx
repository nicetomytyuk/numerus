import { Trophy, Users, Copy, LogOut } from 'lucide-react';

type Props = {
  myPoints: number;
  username: string;
  roomCode: string;
  copied: boolean;
  onCopy: () => void;
  onExit: () => void;
  showRoomCode: boolean;
};

const TopBar = ({ myPoints, username, roomCode, copied, onCopy, onExit, showRoomCode }: Props) => (
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
      {showRoomCode && (
        <button className="pill code nav-btn" onClick={onCopy}>
          <Copy size={16} />
          {copied ? 'Copiato' : roomCode || '---'}
        </button>
      )}
      <button className="pill danger nav-btn" onClick={onExit} aria-label="Esci dalla partita">
        <LogOut size={16} />
      </button>
    </div>
  </header>
);

export default TopBar;
