import { RefObject } from 'react';
import type { Difficulty, Message, Player } from '../types';
import { HARD_MESSAGE_LIFETIME, HARD_VANISH_DURATION } from '../constants';

type Props = {
  messages: Message[];
  gameOver: boolean;
  difficulty: Difficulty;
  now: number;
  endRef: RefObject<HTMLDivElement | null>;
  players: Player[];
};

const ChatFeed = ({ messages, gameOver, difficulty, now, endRef, players }: Props) => (
  <section className={`chat ${gameOver ? 'chat-danger' : ''}`}>
    {messages.map((msg) => {
      const isVanishing =
        difficulty === 'hard' && now - msg.timestamp >= HARD_MESSAGE_LIFETIME - HARD_VANISH_DURATION;
      const playerName = msg.player
        || (msg.playerId ? players.find((p) => p.id === msg.playerId)?.name : undefined)
        || '';
      return (
        <div key={msg.timestamp + msg.text} className={`chat-row ${isVanishing ? 'vanishing' : ''}`}>
          {msg.type === 'system' && <div className="chat-system">{msg.text}</div>}
          {msg.type === 'play' && (
            <div className="chat-play">
              <span className="chat-player">{playerName}</span>
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
    <div ref={endRef} />
  </section>
);

export default ChatFeed;
