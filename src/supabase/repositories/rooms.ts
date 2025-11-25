import { supabase } from '../client';
import type { RoomRow } from '../types';
import type { Difficulty } from '../../types';

export const createRoom = async (params: {
  code: string;
  difficulty: Difficulty;
  showHints: boolean;
}): Promise<RoomRow | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('rooms')
    .insert({
      code: params.code,
      difficulty: params.difficulty,
      show_hints: params.showHints,
      status: 'active',
      current_number: 1,
      current_player_index: 0
    })
    .select()
    .single();
  if (error) throw error;
  return data as RoomRow;
};

export const getRoomByCode = async (code: string): Promise<RoomRow | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase.from('rooms').select('*').eq('code', code).single();
  if (error) throw error;
  return data as RoomRow;
};

export const updateRoomState = async (
  roomId: string,
  payload: Partial<Pick<RoomRow, 'current_number' | 'current_player_index' | 'status'>>
) => {
  if (!supabase) return;
  const { error } = await supabase.from('rooms').update({
    current_number: payload.current_number,
    current_player_index: payload.current_player_index,
    status: payload.status
  }).eq('id', roomId);
  if (error) throw error;
};
