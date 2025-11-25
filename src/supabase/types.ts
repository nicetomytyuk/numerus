export type RoomRow = {
  id: string;
  code: string;
  difficulty: 'easy' | 'normal' | 'hard';
  show_hints: boolean;
  status: 'active' | 'finished';
  current_number: number;
  current_player_index: number;
  created_at: string;
};

export type PlayerRow = {
  id: string;
  room_id: string;
  name: string;
  is_bot: boolean;
  points: number;
  turn_order: number;
  is_owner: boolean;
  created_at: string;
};

export type MessageRow = {
  id: number;
  room_id: string;
  player_id: string | null;
  type: 'system' | 'play' | 'error';
  text: string;
  number: number | null;
  correct_roman: string | null;
  created_at: string;
};
